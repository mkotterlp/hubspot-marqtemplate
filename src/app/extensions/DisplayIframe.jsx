import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, RadioButton, Icon, Flex, Box, Heading, Image, Input, Dropdown, Link, Button, ButtonRow, Table, Form, TableHead, TableHeader, TableCell, TableBody, TableRow, Text, Divider, EmptyState, LoadingSpinner, hubspot } from "@hubspot/ui-extensions";
import { CrmActionButton, CrmActionLink, CrmCardActions, CrmAssociationTable } from '@hubspot/ui-extensions/crm';

hubspot.extend(({ context, actions, runServerlessFunction }) => (
  <Extension context={context} actions={actions} runServerless={runServerlessFunction} />
));

const Extension = ({ context, actions, runServerless }) => {
  const [iframeUrl, setIframeUrl] = useState('');
  const [marquserid, setMarquserid] = useState('');
  const [isPolling, setIsPolling] = useState(false);
  const [isAccountPolling, setAccountIsPolling] = useState(false);

  const [isConnectToMarq, setIsConnectToMarq] = useState(false);  // New state to track connection flow
  const [isConnectedToMarq, setIsConnectedToMarq] = useState(false); // Set to true when user connects to Marq
  const [showAccountTokenButton, setShowAccountTokenButton] = useState(false);
  const [accountoauthUrl, setAccountAuthorizationUrl] = useState('');


  const [showTemplates, setShowTemplates] = useState(true);
  const [apiKey, setAPIkey] = useState('');
  const [accessToken, setAccessToken] = useState(null);
  const [authurl, setauth] = useState(''); //setauthConnectToMarq
  const [authurlConnectToMarq, setauthConnectToMarq] = useState(''); //setauthConnectToMarq
  const [authurlAccountToken, setauthAccountToken] = useState(''); //setauthAccountToken


  const [templates, setTemplates] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [fulltemplatelist, setfullTemplates] = useState([]);
  const [isIframeOpen, setIframeOpen] = useState(false);
  const [title, setTitle] = useState('Relevant Content');
  const [stageName, setStage] = useState('');
  const [propertiesToWatch, setpropertiesToWatch] = useState([]);
  const [objectType, setObjectType] = useState('');
  const [initialFilteredTemplates, setInitialFilteredTemplates] = useState([]);
  const [config, setConfig] = useState({});
  const [fieldsArray, setFieldsArray] = useState([]);
  const [filtersArray, setFiltersArray] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'none' });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [dataFetched, setDataFetched] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [lastModifiedDate, setLastModifiedDate] = useState('');
  const hasInitialized = useRef(false);
  const RECORDS_PER_PAGE = 10;
  const [hoveredRow, setHoveredRow] = useState(null);
  const [crmProperties, setCrmProperties] = useState({});
  const [shouldPollForProjects, setShouldPollForProjects] = useState(false); // New state for polling
  const [prevProjectCount, setPrevProjectCount] = useState(0);
  const previousProjectCountRef = useRef(projects.length); 
  const pollingTimerRef = useRef(null);
  const [hasSyncedOnce, setHasSyncedOnce] = useState(false);

  let propertiesBody = {}; 
  let configData = {};
  let templateLink;
  let currentRefreshToken = "";
  let currentAccountRefreshToken = "";
  let lastTemplateSyncDate;
  // let marquserid

  

  const fetchObjectType = async () => {
    try {
      const objectTypeResponse = await runServerless({
        name: 'objectType',
        parameters: { objectTypeId: context.crm.objectTypeId }
      });

      if (objectTypeResponse && objectTypeResponse.response && objectTypeResponse.response.body) {
        const objectTypeResponseBody = JSON.parse(objectTypeResponse.response.body);
        setObjectType(objectTypeResponseBody.objectType);
      } else {
        console.error("Error: Response body is undefined or not structured as expected.", objectTypeResponse);
      }
    } catch (error) {
      console.error("Error fetching object type:", error);
    }
  };




 
  const fetchPropertiesAndLoadConfig = async (objectType) => {
    try {
      setIsLoading(true);
  
      const userid = context.user.id;
  
      // Validate that userid is available before proceeding
      if (!userid) {
        console.error("Error: Missing user ID.");
        setIsLoading(false);
        return;
      }
  
      // Fetch user data from the 'marqouathhandler' serverless function
      try {
        setIsLoading(true);
        const createusertable = await runServerless({
          name: 'marqouathhandler',
          parameters: { userID: userid }
        });
  
        if (createusertable?.response?.body) {
          const responseBody = JSON.parse(createusertable.response.body);
          const userData = responseBody.row?.values || {}; // Access values directly from row
          lastTemplateSyncDate = userData.lastTemplateSyncDate;
          console.log('lastTemplateSyncDate', lastTemplateSyncDate);
          templateLink = userData.templatesfeed;
          const marquserid = userData.marqUserID;
          // const marquserid = userData.marqUserID;

          currentRefreshToken = userData.refreshToken;

          console.log("Fetched User Data:", JSON.stringify(userData));
          // setRefreshToken(currentRefreshToken)
          // Validate required values before proceeding with further operations
          if (!currentRefreshToken || !marquserid) {
            setIsLoading(false);
            setShowTemplates(false);
            return;
          }
  
          setMarquserid(marquserid);

          const currentTime = Date.now();
          const timeDifference = currentTime - lastTemplateSyncDate;
          const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
  
          // Fetch templates if template link is missing
          if (((timeDifference > twentyFourHoursInMs) && currentRefreshToken) || (!templateLink && currentRefreshToken)) {
            console.log("More than 24 hours since the last sync or template link is null, fetching new templates...");

            setIsLoading(true);
            try {
            
              const fetchResult = await runServerless({
                name: 'fetchTemplates',
                parameters: { 
                  userID: userid,
                  marquserid: marquserid,
                  refreshToken: currentRefreshToken 
                }
              });
              setIsLoading(true);
              
              // Log the full response object
              console.log("Full fetchResult from serverless function:", JSON.stringify(fetchResult, null, 2));
              
              if (fetchResult && fetchResult.response) {
                const statusCode = fetchResult.response.statusCode;
              
                if (statusCode === 200 && fetchResult.response.body) {
                  try {
                    const fetchedData = JSON.parse(fetchResult.response.body);
                    
                    // Check if the required data is present
                    if (fetchedData.templatesjsonurl && fetchedData.newRefreshToken) {
                      templateLink = fetchedData.templatesjsonurl;
                      currentRefreshToken = fetchedData.newRefreshToken;
              
                      console.log("Success! Fetched new template link:", templateLink);
                      console.log("Success! Fetched new refresh token:", currentRefreshToken);
                    } else {
                      console.error("Error: Missing expected data in response body.", fetchedData);
                      templateLink = '';
                      currentRefreshToken = '';
                    }
                  } catch (jsonError) {
                    console.error("Error parsing JSON response:", jsonError, fetchResult.response.body);
                    templateLink = '';
                    currentRefreshToken = '';
                  }
                } else {
                  // Handle non-200 status codes
                  console.error("Failed to fetch new template link. Status Code:", statusCode, "Response body:", fetchResult.response.body);
                  templateLink = '';
                  currentRefreshToken = '';
                }
              } else {
                // Handle missing response
                console.error("Error: fetchResult or response is undefined or malformed.", fetchResult);
                templateLink = '';
                currentRefreshToken = '';
              }
              
              
              

              try {
                setIsLoading(true);
                const updateResult = await runServerless({
                  name: 'updateUserTable',
                  parameters: {
                    userID: userid,
                    refreshToken: currentRefreshToken,
                    templatesJsonUrl: templateLink,
                  }
                });
              } catch (updateError) {
                console.error("Error occurred while trying to update HubDB:", updateError);
              }

            } catch (fetchError) {
              console.error("Error occurred while fetching new template link:", fetchError);
            }
          }
  
          console.log("Fetched Template Link:", JSON.stringify(templateLink));
        } else {
          console.error("Failed to create or fetch user table.");
          console.error('Unexpected structure in createusertable:', JSON.stringify(createusertable));
        }
      } catch (userTableError) {
        console.error("Error occurred while fetching user table:", userTableError);
      }
  
      // Validate that objectType is available
      if (!objectType) {
        console.error("Error: Missing objectType.");
        setIsLoading(false);
        return;
      }
  
      // Fetch config data from 'hubdbHelper'
      try {
        setIsLoading(true);
        const configDataResponse = await runServerless({
          name: 'hubdbHelper',
          parameters: { objectType }
        });
  
        if (configDataResponse?.response?.body) {
          configData = JSON.parse(configDataResponse.response.body).values || {};
          const fields = configData.textboxFields?.split(',').map(field => field.trim()) || [];
          const filters = configData.textboxFilters?.split(',').map(filter => filter.trim()) || [];
          setFieldsArray(fields);
          setFiltersArray(filters);
  
          const propertiesToWatch = configData.textboxFields ? configData.textboxFields.split(',').map(field => field.trim()) : [];
          setpropertiesToWatch(propertiesToWatch);
  
          // Fetch CRM properties if fields are available
          if (fields.length > 0) {
            try {
              const propertiesResponse = await runServerless({
                name: 'getObjectProperties',
                parameters: { objectId: context.crm.objectId, objectType, properties: fields }
              });
  
              if (propertiesResponse?.response?.body) {
                propertiesBody = JSON.parse(propertiesResponse.response.body).mappedProperties || {};
                if (objectType === 'DEAL') {
                  setStage(propertiesBody.dealstage);
                }
              } else {
                console.error("Failed to fetch CRM properties:", propertiesResponse);
              }
            } catch (propertiesError) {
              console.error("Error occurred while fetching CRM properties:", propertiesError);
            }
          }
          
          // Fetch templates from 'fetchJsonData'
          if (templateLink) {
            console.log("Applying templates");
            try {
              setIsLoading(true);
              const templatesResponse = await runServerless({
                name: 'fetchJsonData',
                parameters: { templateLink }
              });
  
              if (templatesResponse?.response?.body) {
                const data = JSON.parse(templatesResponse.response.body);
                const fetchedTemplates = data.templatesresponse || [];
                setfullTemplates(fetchedTemplates);
  
                if (fields.length && filters.length && Object.keys(propertiesBody).length > 0) {
                  const filtered = fetchedTemplates.filter(template => {
                    return fields.every((field, index) => {
                      const categoryName = filters[index];
                      const propertyValue = propertiesBody[field]?.toLowerCase();
                      const category = template.categories.find(c => c.category_name.toLowerCase() === categoryName.toLowerCase());
                      return category && category.values.map(v => v.toLowerCase()).includes(propertyValue);
                    });
                  });
                  setFilteredTemplates(filtered.length > 0 ? filtered : fetchedTemplates);
                  setInitialFilteredTemplates(filtered.length > 0 ? filtered : fetchedTemplates);
                } else {
                  setTemplates(fetchedTemplates);
                  setFilteredTemplates(fetchedTemplates);
                }
              } else {
                console.error("Error fetching templates:", templatesResponse);
              }
            } catch (templatesError) {
              console.error("Error occurred while fetching templates:", templatesError);
            }
          } else {
            console.error("Error: Missing template link to fetch templates.");

            if (currentRefreshToken) {
              console.log('Refresh token', currentRefreshToken)
              setShowTemplates(true);
            } else {
              console.log('Missing refresh token', currentRefreshToken)
              setShowTemplates(false);
              setIsLoading(false);
              actions.addAlert({
                title: "Error with template sync",
                variant: "danger",
                message: `There was an error fetching templates. Please try connecting to Marq again`
              });
            }
          }
        } else {
          console.error("Failed to load config data:", configDataResponse);
        }
      } catch (configError) {
        console.error("Error occurred while fetching config data:", configError);
      }
  
      setIsLoading(false);
    } catch (error) {
      console.error("Error in fetchConfigCrmPropertiesAndTemplates:", error);
      setIsLoading(false);
    }
  };
  



  const filterTemplates = (allTemplates, searchTerm, fieldsArray, filtersArray, properties) => {
    let filtered = Array.isArray(allTemplates) ? allTemplates : [];

    // Dynamically extract filters
    const categoryFilters = extractFiltersFromProperties(fieldsArray, filtersArray, properties);

    // Apply category filters with additional logic to include templates without certain filters
    filtered = filtered.filter(template =>
        categoryFilters.every(filter =>
            Array.isArray(template.categories) && template.categories.some(category =>
                (category.category_name === filter.name && category.values.includes(filter.value)) ||
                (category.category_name === filter.name && category.values.length === 0) // Include templates with no values for the category
            )
        )
    );

    // Apply search filter (searching within all templates)
    if (searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(template =>
            template?.title?.toLowerCase().includes(lowerCaseSearchTerm)
        );
    }

    if (filtered.length === 0) {
      filtered = allTemplates; 
  }




    setFilteredTemplates(filtered);
    setTotalPages(Math.ceil(filtered.length / RECORDS_PER_PAGE));
    setCurrentPage(1); // Reset to first page
};

  





const deleteRecord = async (recordId, objectType) => {
  try {
    await runServerless({
      name: 'deleteRecord',
      parameters: { recordId, objectType }
    });

    // Remove the deleted record from the projects state
    setProjects((prevProjects) => prevProjects.filter(project => project.objectId !== recordId));
    
    // Add success alert
    actions.addAlert({
      title: "Success",
      message: "Project deleted successfully",
      variant: "success"
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    
    // Add error alert
    actions.addAlert({
      title: "Error",
      variant: "error",
      message: `Failed to delete project: ${error.message}`,
    });
  }
};


  

  function formatDate(dateString) {
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    };
    const date = new Date(dateString);
    return date.toLocaleString('en-US', options);
  }

  const fetchAssociatedProjectsAndDetails = useCallback(async (objectType) => {
    console.log("Fetching projects");
    if (!context.crm.objectId) {
      console.error("No object ID available to fetch associated projects.");
      setIsLoading(false);
      return [];
    }
  
    try {
      const associatedProjectsResponse = await runServerless({
        name: 'fetchProjects',
        parameters: {
          fromObjectId: context.crm.objectId,
          fromObjectType: objectType
        }
      });
  
      if (associatedProjectsResponse && associatedProjectsResponse.response && associatedProjectsResponse.response.body) {
        const projectsData = JSON.parse(associatedProjectsResponse.response.body);
        console.log("Fetched project data:", projectsData);
  
        if (projectsData && projectsData.results && projectsData.results.length > 0) {
          const uniqueProjectIds = new Set(projectsData.results.flatMap(p => p.to ? p.to.map(proj => proj.id) : []));
          
          const projectDetailsResponse = await runServerless({
            name: 'fetchProjectDetails',
            parameters: { objectIds: Array.from(uniqueProjectIds) }
          });
  
          if (projectDetailsResponse && projectDetailsResponse.response && projectDetailsResponse.response.body) {
            const projectDetails = JSON.parse(projectDetailsResponse.response.body);
  
            const uniqueDetailedProjects = new Map();
            projectsData.results.forEach(project => {
              project.to.forEach(p => {
                const detail = projectDetails.find(d => d.objectId === p.id);
                if (detail) {
                  uniqueDetailedProjects.set(p.id, { ...p, ...detail });
                } else {
                  uniqueDetailedProjects.set(p.id, p);
                }
              });
            });
  
            const detailedProjects = Array.from(uniqueDetailedProjects.values());
            detailedProjects.sort((a, b) => new Date(b.hs_lastmodifieddate) - new Date(a.hs_lastmodifieddate));
  
            // Update state
            setProjects(detailedProjects);
            const totalPages = Math.ceil(detailedProjects.length / RECORDS_PER_PAGE);
            setTotalPages(totalPages);
            setIsLoading(false);
            setDataFetched(true);
  
            // Return the detailed projects
            return detailedProjects;
          }
        } 
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch associated projects:", error);
      setIsLoading(false);
      setDataFetched(true);
      actions.addAlert({
        title: "API Error",
        variant: "error",
        message: `Error fetching associated projects: ${error.message || 'No error message available'}`
      });
      return [];
    }
  }, [context.crm.objectId, runServerless, actions]);
  

  const editClick = async (projectId, fileId, encodedoptions) => {
    try {
      const userId = context.user.id;
      const contactId = context.crm.objectId;
  
      let editorinnerurl = `https://app.marq.com/documents/showIframedEditor/${projectId}/0?embeddedOptions=${encodedoptions}&creatorid=${userId}&contactid=${contactId}&apikey=${apiKey}&objecttype=${objectType}&fileid=${fileId}`;
      let editoriframeSrc = 'https://info.marq.com/marqembed?iframeUrl=' + encodeURIComponent(editorinnerurl);
  
      setIframeUrl(editoriframeSrc);
      actions.openIframeModal({
        uri: editoriframeSrc,
        height: 1500,
        width: 1500,
        title: "Marq Editor",
      });
      setIframeOpen(true);
    } catch (error) {
      console.error('Error in editClick:', error);
    }
  };
  

  const sendEmail = async (project) => {
    try {
      const response = await runServerlessFunction({
        name: 'generateEmailContent',
        parameters: { project }
      });
  
      if (response && response.emailContent) {
        const emailContent = response.emailContent;
        // Open the email composition window with the generated content
        actions.openEmailComposeWindow({
          to: project.contactEmail,
          subject: `Details for project ${project.name}`,
          body: emailContent
        });
      }
    } catch (error) {
      console.error('Failed to generate email content:', error);
    }
  };

  const extractFiltersFromProperties = (fieldsArray, filtersArray, properties) => {
    let filters = [];
    
    fieldsArray.forEach((field, index) => {
      if (properties[field]) {
        const fieldValue = properties[field];
        const filterValue = filtersArray[index];
        filters.push({ name: filterValue, value: fieldValue });
      }
    });

    // console.log("Extracted Filters:", filters);

  
    return filters;
  };
  

  const handleOnSort = (fieldName, currentDirection) => {
    let newDirection = 'descending';
    if (currentDirection === 'ascending') {
      newDirection = 'descending';
    } else if (currentDirection === 'descending') {
      newDirection = 'none';
    } else {
      newDirection = 'ascending';
    }

    setSortConfig({ field: fieldName, direction: newDirection });

    const sortedProjects = [...projects];
    if (newDirection !== 'none') {
      sortedProjects.sort((a, b) => {
        if (a[fieldName] < b[fieldName]) {
          return newDirection === 'ascending' ? -1 : 1;
        }
        if (a[fieldName] > b[fieldName]) {
          return newDirection === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    setProjects(sortedProjects);
  };




  const refreshProjects = async () => {
    console.log("Calling refresh projects");
  
    if (objectType) {
      // Get previous project count from ref
      const previousProjectCount = previousProjectCountRef.current;
      console.log(`Previous project count: ${previousProjectCount}`);
  
      // Fetch the new projects
      const fetchedProjects = await fetchAssociatedProjectsAndDetails(objectType);
      console.log(`Fetched project count: ${fetchedProjects.length}`);
  
      // Check if new projects have been added
      if (fetchedProjects.length > previousProjectCount) {
        console.log("New projects detected, stopping polling");
        setShouldPollForProjects(false); // Stop polling
      } else {
        console.log("No new projects detected, continuing polling");
      }
    } else {
      console.log("Object type not detected");
    }
  };

  // const setapi = async (userid, userEmail, isConnectToMarq) => {
  //   try {
  //     // Fetch the API key from the serverless function
  //     const apiResponse = await runServerless({
  //       name: 'getApiKey'
  //     });
  
  //     if (apiResponse && apiResponse.response && apiResponse.response.body) {
  //       const body = JSON.parse(apiResponse.response.body);
  
  //       if (body && body.key) {
  //         const apiKey = body.key;
  //         setAPIkey(apiKey);  // Set the API key in the state
  
  //         // If this is the "Connect to Marq" flow, handle the connection process
  //         if (isConnectToMarq) {
  //           const authorizationUrl = handleConnectToMarq(apiKey, userid, userEmail);  // Call handleConnectToMarq for initial connection
  //           setauthConnectToMarq(authorizationUrl);  // Set the authorization URL for redirect

  //         } else {
  //           // If this is the "Account Token" flow, handle getting the account token
  //           // const authorizationUrl = handleGetAccountToken(apiKey, userid, userEmail);  // Call handleGetAccountToken for account token flow
  //           // setauthAccountToken(authorizationUrl);  // Set the authorization URL for redirect
  //         }
  
  //         return apiKey;  // Return the API key after success
  //       } else {
  //         // Handle the case when no API key is found
  //         console.error("No API key found in response.");
  //         actions.addAlert({
  //           title: "Error",
  //           variant: "error",
  //           message: "Failed to retrieve API key."
  //         });
  //       }
  //     } else {
  //       // Handle invalid or missing API response
  //       console.error("API response was invalid or missing.");
  //       actions.addAlert({
  //         title: "Error",
  //         variant: "error",
  //         message: "Invalid API response."
  //       });
  //     }
  //   } catch (error) {
  //     // Handle error in retrieving API key
  //     console.error("Error retrieving API key:", error);
  //     actions.addAlert({
  //       title: "Error",
  //       variant: "error",
  //       message: "Failed to retrieve API key."
  //     });
  //   }
  
  //   return null;  // Return null if the API key was not retrieved
  // };
  
// ORIGINAL setapi FUNCTION BEFORE THE adding HANDLEGETACCOUNTTOKEN FUNCTION STUFF
  const setapi = async (userid, userEmail) => {
    try {
      const apiResponse = await runServerless({
        name: 'getApiKey'
      });
  
      if (apiResponse && apiResponse.response && apiResponse.response.body) {
        const body = JSON.parse(apiResponse.response.body);
        if (body && body.key) {
          const apiKey = body.key;
          setAPIkey(apiKey);
          // console.log("API Key loaded:", apiKey);
          const authorizationUrl = await handleConnectToMarq(apiKey, userid, userEmail, "user");  // Pass the API key, userid, and userEmail
          setauth(authorizationUrl);
          const accountauthorizationUrl = await handleConnectToMarq(apiKey, userid, userEmail, "data");
          setAccountAuthorizationUrl(accountauthorizationUrl);
          return apiKey;  // Return the API key
        } else {
          console.error("No API key found in response.");
          actions.addAlert({
            title: "Error",
            variant: "error",
            message: "Failed to retrieve API key."
          });
        }
      } else {
        console.error("API response was invalid or missing.");
        actions.addAlert({
          title: "Error",
          variant: "error",
          message: "Invalid API response."
        });
      }
    } catch (error) {
      console.error("Error retrieving API key:", error);
      actions.addAlert({
        title: "Error",
        variant: "error",
        message: "Failed to retrieve API key."
      });
    }
    return null;  // Return null if the API key was not retrieved
  };

  // const handleClick = async (template) => {
  //   let iframeSrc = 'https://info.marq.com/loading';
  //   setIframeUrl(iframeSrc);
  //   actions.openIframeModal({
  //     uri: iframeSrc,
  //     height: 1500,
  //     width: 1500,
  //     title: "Marq",
  //   });
  //   setIframeOpen(true);
  
  //   try {
  //     if (template && template.id) {
  //       console.log("Template clicked:", template.id, template.title);
  //     } else {
  //       console.error("Template is undefined or missing id.");
  //     }
  //           const userId = context.user.id;
  
  //     // Step 1: Check for existing refresh token
  //     if (!currentRefreshToken) {
  //       try {
  //         console.log("Polling for refresh token...");
  //         const createusertable = await runServerless({
  //           name: 'marqouathhandler',
  //           parameters: { userID: userId }
  //         });
  
  //         if (createusertable?.response?.body) {
  //           const responseBody = JSON.parse(createusertable.response.body);
  //           const userData = responseBody?.row?.values || {};
  //           currentRefreshToken = userData?.refreshToken || null;
  //           if (!currentRefreshToken || currentRefreshToken === 'null' || currentRefreshToken === '') {
  //             console.log("Refresh token not found");
  //             setShowTemplates(false);
  //           }
  //         } else {
  //           console.log("No response body from serverless function.");
  //         }
  //       } catch (error) {
  //         console.error("Error while polling for refresh token:", error);
  //       }
  //     }
  
  //     const userid = context.user.id;
  //     const clientid = 'wfcWQOnE4lEpKqjjML2IEHsxUqClm6JCij6QEXGa';
  //     const clientsecret = 'YiO9bZG7k1SY-TImMZQUsEmR8mISUdww2a1nBuAIWDC3PQIOgQ9Q44xM16x2tGd_cAQGtrtGx4e7sKJ0NFVX';
  //     const marquserId = marquserid; 
  //     const marqaccountid = "163559625"; 
  //     const recordid = context.crm?.objectId?.toString() || '';
  //     const templateid = template?.id || '';
  //     const templatetitle = template?.title || '';
  //     console.log(`marquserid: ${marquserId}`);
  
  //     const contactId = context.crm.objectId;
  //     const enabledFeatures = configData.enabledFeatures?.map(feature => feature.name) || ["share"];
  //     const fileTypes = configData.fileTypes?.map(fileType => fileType.name) || ["pdf"];
  //     const showTabs = configData.showTabs?.map(tab => tab.name) || ["templates"];
  //     const configType = configData.configType?.name || "single";
  //     const dataSetType = configData.dataSetType?.name || "custom";
  //     const key = configData.key || "id";
  
  //     // Step 2: Retrieve or create the dataset ID
  //     let dataSetId;
  //     if (dataSetType === 'custom') {
  //       // Call the createDataset serverless function to create or get a dataset
  //       // const createDatasetResponse = await runServerless({
  //       //   name: 'createDataset',
  //       //   parameters: {
  //       //     refreshToken: currentRefreshToken,
  //       //     schema: [
  //       //       { name: "Id", fieldType: "STRING", isPrimary: true },
  //       //       // Add other fields as required
  //       //     ]
  //       //   }
  //       // });
  
  //       if (createDatasetResponse?.response?.body) {
  //         const datasetData = JSON.parse(createDatasetResponse.response.body);
  //         dataSetId = datasetData.dataSourceId;
  //         console.log("DataSet ID:", dataSetId);
  //       } else {
  //         console.error("Failed to create or get dataset.");
  //         return;
  //       }
  //     }
  
  //     const encodedOptions = encodeURIComponent(btoa(JSON.stringify({
  //       enabledFeatures,
  //       fileTypes,
  //       showTabs,
  //     })));
  
  //     let importData = '';
  //     if (dataSetType === 'property listing') {
  //       importData = `propertyId=${context.crm.objectId}`;
  //     } else if (dataSetType === 'custom') {
  //       importData = `dataSetId=${dataSetId}&key=${key}&value=${context.crm.objectId}`;
  //     }
  
  //     const hasImportData = dataSetType !== 'none' && importData;
  
  //     // Step 3: Call the createProject serverless function to create a new project and get the project ID
  //     const createProjectResponse = await runServerless({
  //       name: 'createProject',
  //       parameters: {
  //         refresh_token: currentRefreshToken,
  //         clientid: clientid,
  //         clientsecret: clientsecret,
  //         marquserId: marquserId,
  //         recordid: recordid,
  //         templateid: templateid,
  //         templatetitle: templatetitle,
  //         marqaccountid: marqaccountid,
  //         dataSetId: dataSetId // Send the retrieved or created dataset ID
  //       }
  //     });
  
  //     // Step 4: Retrieve the projectId from the createProject response
  //     if (createProjectResponse?.response?.body) {
  //       const projectData = JSON.parse(createProjectResponse.response.body);
  //       console.log("Project created:", projectData);
  //       const projectId = projectData.documentid;
  //       currentRefreshToken = projectData.new_refresh_token;
  //       console.log("Created Project ID:", projectId);
  
  //       setIframeLoading(false);
  //       if (!projectId) {
  //         currentRefreshToken = '';
  //         setShowTemplates(false);
  //         actions.addAlert({
  //           title: "Error with creating project",
  //           variant: "danger",
  //           message: `There was an error with creating the project. Please try connecting to Marq again`
  //         });
  //         return;
  //       }
  
  //       const baseInnerUrl = `https://app.marq.com/documents/showIframedEditor/${projectId}/0?embeddedOptions=${encodedOptions}&creatorid=${userid}&contactid=${contactId}&apikey=${apiKey}&objecttype=${objectType}&dealstage=${stageName}&templateid=${template.id}`;
  //       const innerurl = hasImportData ? `${baseInnerUrl}&${importData}` : baseInnerUrl;
  //       iframeSrc = 'https://info.marq.com/marqembed?iframeUrl=' + encodeURIComponent(innerurl);
  //       setIframeUrl(iframeSrc);
  //       actions.openIframeModal({
  //         uri: iframeSrc,
  //         height: 1500,
  //         width: 1500,
  //         title: "Marq",
  //       });
  //     } else {
  //       console.error("Failed to create project.");
  //     }
  //   } catch (error) {
  //     console.error('Error in handleClick:', error);
  //   }
  // };
  
  
  
  const handleClick = async (template) => {
    let iframeSrc = 'https://info.marq.com/loading';

    const schema = [
      { name: "Id", fieldType: "STRING", isPrimary: true, order: 1 },
    ];

    // Set iframe to loading
    setIframeUrl(iframeSrc);
    actions.openIframeModal({
      uri: iframeSrc,
      height: 1500,
      width: 1500,
      title: "Marq",
    });
    setIframeOpen(true);

    try {
      console.log("Template clicked:", template.id, template.title);
      const userId = context.user.id;

      // Check for refresh token or fetch if not available
      if (!currentRefreshToken) {
        try {
          console.log("Polling for refresh token...");
          const createusertable = await runServerless({
            name: 'marqouathhandler',
            parameters: { userID: userId }
          });
          console.log("Response from serverless function:", createusertable);

          if (createusertable?.response?.body) {
            const responseBody = JSON.parse(createusertable.response.body);
            const userData = responseBody?.row?.values || {};
            currentRefreshToken = userData?.refreshToken || null;
            console.log("currentRefreshToken:", currentRefreshToken);

            if (!currentRefreshToken || currentRefreshToken === 'null' || currentRefreshToken === '') {
              console.log("Refresh token not found");
              setShowTemplates(false);
              return;
            }
          } else {
            console.log("No response body from serverless function.");
            return;
          }
        } catch (error) {
          console.error("Error while polling for refresh token:", error);
          return;
        }
      }

      // Log the next steps with IDs
      console.log(`User ID: ${userId}, Template ID: ${template?.id}, Template Title: ${template?.title}`);

      const clientid = 'wfcWQOnE4lEpKqjjML2IEHsxUqClm6JCij6QEXGa';
      const clientsecret = 'YiO9bZG7k1SY-TImMZQUsEmR8mISUdww2a1nBuAIWDC3PQIOgQ9Q44xM16x2tGd_cAQGtrtGx4e7sKJ0NFVX';
      const marquserId = marquserid;
      const marqaccountid = "163559625";
      const recordid = context.crm?.objectId?.toString() || '';
      const templateid = template?.id || '';
      const templatetitle = template?.title || '';
      
      // Fetch dealstage from CRM properties if objectType is 'DEAL'
      let stageName = '';
      if (objectType === 'DEAL') {
        try {
          console.log("Fetching CRM properties for dealstage...");
          const propertiesResponse = await runServerless({
            name: 'getObjectProperties',
            parameters: { objectId: context.crm.objectId, objectType, properties: ['dealstage'] }
          });

          if (propertiesResponse?.response?.body) {
            const crmProperties = JSON.parse(propertiesResponse.response.body).mappedProperties || {};
            stageName = crmProperties.dealstage || '';
            console.log("Dealstage fetched:", stageName);
          } else {
            console.error("Failed to fetch CRM properties:", propertiesResponse);
          }
        } catch (propertiesError) {
          console.error("Error occurred while fetching CRM properties:", propertiesError);
        }
      }

      // Step 1: Fetch data for the objectType using dataTableHandler
      console.log("Calling dataTableHandler for objectType:", objectType);
      const dataTableResponse = await runServerless({
        name: 'dataTableHandler',
        parameters: { objectType: objectType }
      });

      if (!dataTableResponse?.response?.body) {
        console.error("Error: No data returned from dataTableHandler");
        return;
      }

      const dataTableBody = JSON.parse(dataTableResponse.response.body);
      const accountData = dataTableBody?.dataRow?.values || {};
      console.log("Account Data from dataTableHandler:", accountData);

      const collectionId = accountData?.collectionid || null;
      const dataSourceId = accountData?.datasetid || null;
      const refresh_token = accountData?.refreshToken || null;
      const properties = accountData?.properties || {}; // Assuming the properties field exists

      if (!collectionId || !dataSourceId) {
        console.error("Error: Missing collectionId or dataSourceId");
        return;
      }

      // Step 2: Call the updateData3 serverless function to update schema and data
      console.log("Calling updateData3 with collectionId:", collectionId, " dataSourceId:", dataSourceId, "and refresh_token: ", refresh_token);
      const updateData3Response = await runServerless({
        name: 'updateData3',
        parameters: {
          refresh_token: refresh_token,
          clientid: clientid,
          clientsecret: clientsecret,
          collectionId: collectionId,
          properties: properties,
          schema: schema,  
          dataSourceId: dataSourceId
        }
      });

      if (!updateData3Response?.response?.body) {
        console.error("Error: No data returned from updateData3 serverless function");
        return;
      }

      const updateResult = JSON.parse(updateData3Response.response.body);
      console.log("updateData3 Response:", updateResult);

      // Step 3: Proceed with creating the project using the data
      console.log("Creating project with template ID:", templateid);
      const createProjectResponse = await runServerless({
        name: 'createProject',
        parameters: {
          refresh_token: currentRefreshToken,
          clientid: clientid,
          clientsecret: clientsecret,
          marquserId: marquserId,
          recordid: recordid,
          templateid: templateid,
          templatetitle: templatetitle,
          marqaccountid: marqaccountid,
          dataSetId: dataSourceId
        }
      });

      if (createProjectResponse?.response?.body) {
        const projectData = JSON.parse(createProjectResponse.response.body);
        console.log("Project created successfully:", projectData);

        const projectId = projectData.documentid;
        console.log("Created Project ID:", projectId);

        currentRefreshToken = projectData.new_refresh_token;
        console.log("Updated refresh_token after project creation:", currentRefreshToken);

        // Step 4: Set iframe URL and open the iframe
        const encodedOptions = encodeURIComponent(btoa(JSON.stringify({
          enabledFeatures: configData.enabledFeatures?.map(feature => feature.name) || ["share"],
          fileTypes: configData.fileTypes?.map(fileType => fileType.name) || ["pdf"],
          showTabs: configData.showTabs?.map(tab => tab.name) || ["templates"],
        })));

        const baseInnerUrl = `https://app.marq.com/documents/showIframedEditor/${projectId}/0?embeddedOptions=${encodedOptions}&creatorid=${userId}&contactid=${context.crm.objectId}&apikey=${apiKey}&objecttype=${objectType}&dealstage=${stageName}&templateid=${templateid}`;
        const iframeUrlWithImportData = `${baseInnerUrl}&dataSetId=${dataSourceId}`;

        iframeSrc = 'https://info.marq.com/marqembed?iframeUrl=' + encodeURIComponent(iframeUrlWithImportData);

        console.log("Opening iframe with URL:", iframeSrc);
        setIframeUrl(iframeSrc);
        actions.openIframeModal({
          uri: iframeSrc,
          height: 1500,
          width: 1500,
          title: "Marq",
        });
      } else {
        console.error("Failed to create project.");
      }
    } catch (error) {
      console.error('Error in handleClick:', error);
    }
  };

  
  
  


// ORIGINAL handleClick FUNCTION BEFORE THE adding dataTablehandler and updateData3 FUNCTION STUFF
//   const handleClick = async (template) => {

//     let iframeSrc = 'https://info.marq.com/loading';


//      setIframeUrl(iframeSrc);
//      actions.openIframeModal({
//        uri: iframeSrc,
//        height: 1500,
//        width: 1500,
//        title: "Marq",
//      });
//      setIframeOpen(true);
   

//     try {
//       console.log("Template clicked:", template.id, template.title);
//       const userId = context.user.id;

    

// if (!currentRefreshToken) {
//       try {
//         console.log("Polling for refresh token...");
//         const createusertable = await runServerless({
//           name: 'marqouathhandler',
//           parameters: { userID: userId }
//         });
//         console.log("Response from serverless function:", createusertable); 
    
//         if (createusertable?.response?.body) {
//           console.log("Received response from serverless function:", createusertable);
    
//           // Access row and values properly
//           const responseBody = JSON.parse(createusertable.response.body);
//           const userData = responseBody?.row?.values || {};
          
//           console.log("userData:", userData);
    
//           currentRefreshToken = userData?.refreshToken || null;
  
//           console.log("currentRefreshToken:", currentRefreshToken);
    
//           if (currentRefreshToken && currentRefreshToken !== 'null' && currentRefreshToken !== '') {
//             console.log("Refresh token found:", currentRefreshToken);
//           } else {
//             console.log("Refresh token not found");
//             setShowTemplates(false);
//           }
//         } else {
//           console.log("No response body from serverless function.");
//         }
//       } catch (error) {
//         console.error("Error while polling for refresh token:", error);
//       }
//     }


//       const userid = context.user.id;
//       const clientid = 'wfcWQOnE4lEpKqjjML2IEHsxUqClm6JCij6QEXGa';
//       const clientsecret = 'YiO9bZG7k1SY-TImMZQUsEmR8mISUdww2a1nBuAIWDC3PQIOgQ9Q44xM16x2tGd_cAQGtrtGx4e7sKJ0NFVX';
//       const marquserId = marquserid; 
//       const marqaccountid = "163559625"; 
//       const recordid = context.crm?.objectId?.toString() || '';
//       const templateid = template?.id || ''; // Fetching template ID from the clicked template
//       const templatetitle = template?.title || ''; // Fetching template title from the clicked template
//       console.log(`marquserid: ${marquserId}`)


//       const dynamicValue = (configData.value && context.crm.properties && configData.value in context.crm.properties)
//         ? context.crm.properties[configData.value]
//         : null;

//       const contactId = context.crm.objectId;

//       const enabledFeatures = configData.enabledFeatures?.map(feature => feature.name) || ["share"];
//       const fileTypes = configData.fileTypes?.map(fileType => fileType.name) || ["pdf"];
//       const showTabs = configData.showTabs?.map(tab => tab.name) || ["templates"];
//       const configType = configData.configType?.name || "single";
//       const dataSetType = configData.dataSetType?.name || "custom";
//       const dataSetId = configData.dataSetId || `HB.${objectType}`;
//       const key = configData.key || "id";
//       // console.log("handleClick parameters:", { refresh_token, clientid, clientsecret, marquserId, recordid, templateid, templatetitle, marqaccountid, dataSetId });



//       const encodedOptions = encodeURIComponent(btoa(JSON.stringify({
//         enabledFeatures,
//         fileTypes,
//         showTabs,
//       })));
  
//       let importData = '';
//       if (dataSetType === 'property listing') {
//         importData = `propertyId=${dynamicValue || context.crm.objectId}`;
//       } else if (dataSetType === 'custom') {
//         importData = `dataSetId=${dataSetId}&key=${key}&value=${dynamicValue || context.crm.objectId}`;
//       }
  
//       const hasImportData = dataSetType !== 'none' && importData;
  
//       // Step 1: Call the createProject serverless function to create a new project and get the project ID
//       const createProjectResponse = await runServerless({
//         name: 'createProject',
//         parameters: {
//           refresh_token: currentRefreshToken,
//           clientid: clientid,                  // Pass client ID
//           clientsecret: clientsecret,          // Pass client secret
//           marquserId: marquserId,                      // Pass user ID
//           recordid: recordid,                  // Pass CRM record ID
//           templateid: templateid,              // Pass template ID
//           templatetitle: templatetitle,        // Pass template title
//           marqaccountid: marqaccountid,
//           dataSetId: dataSetId
//         }
  
//       });


  
//       // Step 2: Retrieve the projectId from the createProject response
//       if (createProjectResponse && createProjectResponse.response && createProjectResponse.response.body) {
//         const projectData = JSON.parse(createProjectResponse.response.body);
//         console.log("Project created:", projectData);
  
//         const projectId = projectData.documentid; // Get the project ID from the response
//         console.log("Created Project ID:", projectId);

//         currentRefreshToken = projectData.new_refresh_token
//         console.log("refresh_token after project is created: ", currentRefreshToken)
  
//         // // Step 3: Fetch associated projects and check if they are linked to this projectId
//         // const associatedProjectsResponse = await runServerless({
//         //   name: 'fetchProjects',
//         //   parameters: {
//         //     fromObjectId: context.crm.objectId,
//         //     fromObjectType: objectType
//         //   }
//         // });
  
//         // if (associatedProjectsResponse && associatedProjectsResponse.response && associatedProjectsResponse.response.body) {
//         //   const projectsData = JSON.parse(associatedProjectsResponse.response.body);
//         //   // console.log("Fetched project data:", projectsData);
  
//         //   if (projectsData && projectsData.results && projectsData.results.length > 0) {
//         //     const uniqueProjectIds = new Set(projectsData.results.flatMap(p => p.to ? p.to.map(proj => proj.id) : []));
  
//         //     // Fetch project details using the unique project IDs
//         //     const projectDetailsResponse = await runServerless({
//         //       name: 'fetchProjectDetails',
//         //       parameters: { objectIds: Array.from(uniqueProjectIds) }
//         //     });
  
//         //     if (projectDetailsResponse && projectDetailsResponse.response && projectDetailsResponse.response.body) {
//         //       const projectDetails = JSON.parse(projectDetailsResponse.response.body);
//         //       // console.log("Fetched project details:", projectDetails);
  
//         //       const associatedProjectId = projectDetails[0].projectid; // Assuming the first result is the relevant one
//         //       // console.log("Associated Project ID:", associatedProjectId);
  
//               // Step 4: Now proceed with the iframe URL creation using projectId and other necessary details

//               setIframeLoading(false);
//               if(!projectId) {
//                 currentRefreshToken = '';
//                 setShowTemplates(false);
//               actions.addAlert({
//                 title: "Error with creating project",
//                 variant: "danger",
//                 message: `There was an error with creating the project. Please try connecting to Marq again`
//               });

//               try {
//                 const updateResult = await runServerless({
//                   name: 'updateUserRefresh',
//                   parameters: {
//                     userID: userid,
//                     newrefreshtoken: currentRefreshToken
//                   }
//                 });
//               } catch (updateError) {
//                 console.error("Error occurred while trying to update HubDB:", updateError);
//               }

//                 return

//               }


//                 const baseInnerUrl = `https://app.marq.com/documents/showIframedEditor/${projectId}/0?embeddedOptions=${encodedOptions}&creatorid=${userid}&contactid=${contactId}&apikey=${apiKey}&objecttype=${objectType}&dealstage=${stageName}&templateid=${template.id}`;
//                 const innerurl = hasImportData ? `${baseInnerUrl}&${importData}` : baseInnerUrl;
//                 iframeSrc = 'https://info.marq.com/marqembed?iframeUrl=' + encodeURIComponent(innerurl);
              
  
//               // Step 5: Open the iframe with the generated URL
//               setIframeUrl(iframeSrc);


//               setIframeUrl(iframeSrc);
//               actions.openIframeModal({
//                 uri: iframeSrc,
//                 height: 1500,
//                 width: 1500,
//                 title: "Marq",
//               });

//             } else {
//               console.error("Failed to fetch project details or empty response");
//             }

//             try {
//               const updateResult = await runServerless({
//                 name: 'updateUserRefresh',
//                 parameters: {
//                   userID: userid,
//                   newrefreshtoken: currentRefreshToken,
//                   // newrefreshtoken: newrefreshtoken

//                 }
//               });
//             } catch (updateError) {
//               console.error("Error occurred while trying to update HubDB:", updateError);
//             }

//     //       } else {
//     //         console.error("Failed to fetch associated projects: Empty results array");
//     //       }
//     //     } else {
//     //       console.error("Failed to fetch associated projects.");
//     //     }
//     //   } else {
//     //     console.error("Failed to create project or empty response.");
//     //   }
  
//  } 
//     catch (error) {
//       console.error('Error in handleClick:', error);
//     }
//   };

const startPollingForRefreshToken = () => {
  setIsLoading(true);
  setIsPolling(true); // Start polling when the button is clicked
};

const pollForRefreshToken = async () => {
  console.log("Attempting poll");

  try {
    console.log("Polling for refresh token...");
    const userId = context.user.id;
    const createusertable = await runServerless({
      name: 'marqouathhandler',
      parameters: { userID: userId }
    });

    console.log("Response from serverless function:", createusertable);

    if (createusertable?.response?.body) {
      console.log("Received response from serverless function:", createusertable);

      // Access row and values properly
      const responseBody = JSON.parse(createusertable.response.body);
      const userData = responseBody?.row?.values || {};

      console.log("userData:", userData);

      // Assign to global `currentRefreshToken`
      currentRefreshToken = userData?.refreshToken || null;
      console.log("currentRefreshToken:", currentRefreshToken);

      if (currentRefreshToken && currentRefreshToken !== 'null' && currentRefreshToken !== '') {
        console.log("Refresh token found:", currentRefreshToken);
        setIsPolling(false); // Stop polling
        fetchPropertiesAndLoadConfig(objectType); // Ensure objectType is defined
        setIsConnectedToMarq(true); // Assuming this should trigger some UI change
      } else {
        console.log("Refresh token not found yet, continuing to poll...");
        setShowTemplates(false);
      }
    } else {
      console.log("No response body from serverless function.");
    }
  } catch (error) {
    console.error("Error while polling for refresh token:", error);
  }
};

useEffect(() => {
  let pollInterval;

  if (isPolling) {
    console.log("Starting to poll for refresh token every 5 seconds.");
    pollInterval = setInterval(pollForRefreshToken, 5000); // Poll every 5 seconds
  }

  return () => {
    console.log("Stopping the polling for refresh token.");
    clearInterval(pollInterval); // Clean up interval when component unmounts or polling stops
  };
}, [isPolling]);






  const startPollingForAccountRefreshToken = () => {
    setAccountIsPolling(true); // Start polling when the button is clicked
};

const pollForAccountRefreshToken = async () => {
    console.log("Attempting poll for account refresh token");

    try {
        console.log("Polling for account refresh token...");

        // Call the serverless function to get account data
        const createaccounttable = await runServerless({
            name: 'dataTableHandler',
            parameters: { objectType: objectType } // Ensure objectType is valid
        });

        console.log("Response from serverless function:", createaccounttable); 

        if (createaccounttable?.response?.body) {
            console.log("Received response from serverless function");

            // Parse the response body to access account data
            const accountresponseBody = JSON.parse(createaccounttable.response.body);
            const accountData = accountresponseBody?.dataRow?.values || {};
            
            console.log("accountData:", accountData);

            // Retrieve the refresh token from the account data
            currentAccountRefreshToken = accountData?.refreshToken || null;
            console.log("currentAccountRefreshToken:", currentAccountRefreshToken);

            // Check if the refresh token was found
            if (currentAccountRefreshToken && currentAccountRefreshToken !== 'null' && currentAccountRefreshToken !== '') {
                console.log("Account refresh token found:", currentAccountRefreshToken);

                // Stop polling once we have the token
                setAccountIsPolling(false);
                setShowAccountTokenButton(false);

                // Call the createOrUpdateDataset function with the found account refresh token
                await createOrUpdateDataset(currentAccountRefreshToken);
            } else {
                console.log("Account refresh token not found, continuing to poll...");
                setShowAccountTokenButton(true); // Display button to try again
            }
        } else {
            console.log("No response body from serverless function.");
        }
    } catch (error) {
        console.error("Error while polling for account refresh token:", error);
    }
};

useEffect(() => {
    let pollAccountInterval;

    // Start polling if the account is set to be polling
    if (isAccountPolling) {
        console.log("Starting to poll for account refresh token every 5 seconds.");
        pollAccountInterval = setInterval(pollForAccountRefreshToken, 5000); // Poll every 5 seconds
    }

    // Cleanup interval when polling stops or component unmounts
    return () => {
        console.log("Stopping the polling for account refresh token.");
        clearInterval(pollAccountInterval);
    };
}, [isAccountPolling]);

  
  


// ORIGINAL startPollingForAccountRefreshToken FUNCTION
  // const startPollingForAccountRefreshToken = () => {
  //   setAccountIsPolling(true); // Start polling when the button is clicked
  // };
  
  // const pollForAccountRefreshToken = async () => {
  //   console.log("Attempting poll");

  //   try {
  //     console.log("Polling for account refresh token...");
  //     const createaccounttable = await runServerless({
  //       name: 'dataTableHandler',
  //       parameters: { objectType: objectType }
  //     });
  //     console.log("Response from serverless function:", createaccounttable); 
  
  //     if (createaccounttable?.response?.body) {
  //       console.log("Received response from serverless function:", createaccounttable);
  
  //       // Access row and values properly
  //       const accountresponseBody = JSON.parse(createaccounttable.response.body);
  //       const accountData = accountresponseBody?.dataRow?.values || {};
        
  //       console.log("accountData:", accountData);
  
  //       currentAccountRefreshToken = accountData?.refreshToken || null;

  //       console.log("currentAccountRefreshToken:", currentAccountRefreshToken);
  
  //       if (currentAccountRefreshToken && currentAccountRefreshToken !== 'null' && currentAccountRefreshToken !== '') {
  //         console.log("Account Refresh token found:", currentAccountRefreshToken);
  //         setAccountIsPolling(false); // Stop polling
  //         fetchPropertiesAndLoadConfig(objectType);
  //         setShowAccountTokenButton(false); 
  //         // setIsConnectedToMarq(true); // Blake added this
  //       } else {
  //         console.log("Account Refresh token not found yet, continuing to poll...");
  //         setShowTemplates(false);
  //         // setShowAccountTokenButton(true);
  //       }
  //     } else {
  //       console.log("No response body from serverless function.");
  //     }
  //   } catch (error) {
  //     console.error("Error while polling for account refresh token:", error);
  //   }
  // };
  
  
  
  // useEffect(() => {
  //   let pollAccountInterval;
  
  //   if (isAccountPolling) {
  //     console.log("Starting to poll for account refresh token every 5 seconds.");
  //     pollAccountInterval = setInterval(pollForAccountRefreshToken, 5000); // Poll every 5 seconds
  //   }
  
  //   return () => {
  //     console.log("Stopping the polling for account refresh token.");
  //     clearInterval(pollAccountInterval); // Clean up interval when component unmounts or polling stops
  //   };
  // }, [isAccountPolling]);
  
  

  useEffect(() => {
    if (shouldPollForProjects) {
        const pollingForProjects = async () => {
            console.log("Polling for projects");

            // Only consider previous project count if sync has happened
            if (hasSyncedOnce) {
                const previousProjectCount = previousProjectCountRef.current;
                console.log("Previous project count:", previousProjectCount);
            }

            await refreshProjects(); // Fetch new projects

            const fetchedProjectCount = projects.length;
            console.log("Fetched project count:", fetchedProjectCount);

            // Handle first sync
            if (!hasSyncedOnce) {
                console.log("First sync completed, setting previous project count");
                previousProjectCountRef.current = fetchedProjectCount;
                setHasSyncedOnce(true);
            } else if (fetchedProjectCount > previousProjectCountRef.current) {
                console.log("New projects detected, stopping polling");
                setShouldPollForProjects(false); // Stop polling if new projects are found
            } else {
                console.log("No new projects detected, continuing polling");
                previousProjectCountRef.current = fetchedProjectCount;
                pollingTimerRef.current = setTimeout(pollingForProjects, 20000); // Continue polling every 20 seconds
            }
        };

        // Clear any existing timer before starting a new one
        if (pollingTimerRef.current) {
            clearTimeout(pollingTimerRef.current);
        }

        // Start polling
        pollingForProjects();

        // Cleanup to stop polling when unmounted or when polling stops
        return () => {
            if (pollingTimerRef.current) {
                clearTimeout(pollingTimerRef.current);
            }
            setShouldPollForProjects(false);
        };
    }
}, [shouldPollForProjects, refreshProjects, hasSyncedOnce, projects.length]);


  useEffect(() => {
    fetchObjectType();
  }, [context.crm.objectTypeId, runServerless]);
  

  const handleSearch = useCallback((input) => {
    let searchValue = '';
    if (input && input.target) {
      searchValue = input.target.value;
    } else if (input) {
      searchValue = String(input);
    } else {
      console.error('Unexpected input:', input);
    }
  
    setSearchTerm(searchValue);
  
    if (searchValue.trim() === '') {
      setFilteredTemplates(initialFilteredTemplates); // Reset to initially filtered templates
      setTitle('Relevant Content');
    } else {
      setTitle('Search Results');
    }
  }, [initialFilteredTemplates]);
  
  useEffect(() => {
    if (searchTerm.trim() !== '') {
      const delayDebounceFn = setTimeout(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();


        const searchResults = fulltemplatelist.filter(template =>
          template?.title?.toLowerCase().includes(lowerCaseSearchTerm)
        );
   
  
        // Combine search results with initially filtered templates
        setFilteredTemplates([...searchResults]);
        setCurrentPage(1); // Reset to first page on search
      }, 300);
  
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchTerm, templates, initialFilteredTemplates]);
  


useEffect(() => {
  const pages = Math.ceil(filteredTemplates.length / RECORDS_PER_PAGE);
  setTotalPages(pages);
}, [filteredTemplates]);
 

const handlePageChange = (pageNumber) => {
  if (pageNumber >= 1 && pageNumber <= totalPages) {
    setCurrentPage(pageNumber);
  }
};


const paginatedTemplates = filteredTemplates.slice(
  (currentPage - 1) * RECORDS_PER_PAGE,
  currentPage * RECORDS_PER_PAGE
);

// const initialize = async () => {
//   if (!hasInitialized.current && objectType) {
//     hasInitialized.current = true;

//     // Fetch and load properties and associated projects
//     fetchPropertiesAndLoadConfig(objectType);
//     fetchAssociatedProjectsAndDetails(objectType);

//     // Fetch the userid and userEmail from context
//     const userid = context.user.id;
//     const userEmail = context.user.email; // Assuming context provides the user's email here

//     // Check if we are in the "Connect to Marq" flow
//     if (isConnectToMarq) {
//       // Fetch the API key and pass the userid, userEmail, and true for the "Connect to Marq" flow
//       const apiKey = await setapi(userid, userEmail, true);  // Pass true for the connect flow
//       setAPIkey(apiKey);

//       // After connecting to Marq, set the connected state to true
//       setIsConnectedToMarq(true);

//       // Reset isConnectToMarq to prevent unnecessary re-invocations
//       setIsConnectToMarq(false);
//       // this ^^ is different than the one above it
//     }

//     // Fetch Marq user data and update refresh token if necessary
//     const createusertable = await runServerless({
//       name: 'marqouathhandler',
//       parameters: { userID: userid }
//     });

//     if (createusertable?.response?.body) {
//       const userData = JSON.parse(createusertable.response.body).values || {};
//       const currentRefreshToken = userData.refreshToken;

//       if (currentRefreshToken) {
//         setIsConnectedToMarq(true);  // User is connected to Marq
//         showTemplates(true);  // Show templates if a valid refresh token exists
//       } else {
//         setIsConnectedToMarq(false);  // User is not connected to Marq
//       }
//     } else {
//       console.error("Failed to create or fetch user table.");
//       setIsConnectedToMarq(false);  // Set to false if there's an error
//     }

//   } else if (
//     hasInitialized.current &&
//     fieldsArray.length > 0 &&
//     filtersArray.length > 0 &&
//     Object.keys(crmProperties).length > 0
//   ) {
//     // Apply template filtering based on the search term and loaded properties
//     filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
//   }
// };



const initialize = async () => {
  // Ensure we haven't initialized already and that objectType is available
  if (!hasInitialized.current && objectType) {
    hasInitialized.current = true;

    // Fetch properties and associated projects for the objectType
    fetchPropertiesAndLoadConfig(objectType);
    fetchAssociatedProjectsAndDetails(objectType);

    try {
      // Fetch the userid and userEmail from context
      const userid = context.user.id;
      const userEmail = context.user.email; // Assuming context provides the user's email here

      console.log(userid, userEmail);
      
      // Fetch the API key and pass the userid and userEmail
      const apiKey = await setapi(userid, userEmail);
      setAPIkey(apiKey);

      // Fetch Marq user data and update refresh token if necessary
      const createusertable = await runServerless({
        name: 'marqouathhandler',
        parameters: { userID: userid }
      });

      if (createusertable?.response?.body) {
        // Parse user data and extract refresh token
        const responseBody = JSON.parse(createusertable.response.body);
        const userData = responseBody.row?.values || {}; // Access values directly from row
        currentRefreshToken = userData.refreshToken;
        console.log("Fetched User Data:", JSON.stringify(userData));

        // Log and show templates if refresh token is available
        console.log("User refresh token:", currentRefreshToken);
        if (currentRefreshToken) {
          setShowTemplates(true);
        }
      } else {
        console.error("Failed to create or fetch user table.");
      }

      // Fetch Marq account data and update refresh token if necessary
      const createaccounttable = await runServerless({
        name: 'dataTableHandler',
        parameters: { objectType: objectType }
      });

      if (createaccounttable?.response?.body) {
        // Parse account data and extract refresh token
        const accountresponseBody = JSON.parse(createaccounttable.response.body);
        const accountData = accountresponseBody?.dataRow?.values || {};

        // Log the account data and refresh token
        console.log("Account Data:", accountData);

        const currentAccountRefreshToken = accountData?.refreshToken || null;
        console.log("currentAccountRefreshToken:", currentAccountRefreshToken);

        // Conditionally show templates and the account token button
        if (currentAccountRefreshToken) {
          setShowTemplates(true);
          setShowAccountTokenButton(false);
        } else {
          setShowAccountTokenButton(true);
          // Call the createOrUpdateDataset function only if there's no refresh token
          console.log("Calling createOrUpdateDataset as no account refresh token exists.");
          await createOrUpdateDataset(currentAccountRefreshToken);
        }

        // Ensure templates are shown
        setShowTemplates(true);

      } else {
        console.error("Failed to create or fetch account table.");
      }

    } catch (error) {
      console.error("Error in initialization:", error);
    }
  } else if (
    hasInitialized.current &&
    fieldsArray.length > 0 &&
    filtersArray.length > 0 &&
    Object.keys(crmProperties).length > 0
  ) {
    // If already initialized, filter templates based on search criteria
    filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
  }
};








// ORIGINAL INITIALIZE FUNCTION 
// const initialize = async () => {
//   if (!hasInitialized.current && objectType) {
//     hasInitialized.current = true;

//     fetchPropertiesAndLoadConfig(objectType);
//     fetchAssociatedProjectsAndDetails(objectType);

//     // Fetch the userid and userEmail from context
//     const userid = context.user.id;
//     const userEmail = context.user.email; // Assuming context provides the user's email here

//     // Fetch the API key and pass the userid and userEmail
//     const apiKey = await setapi(userid, userEmail);
//     setAPIkey(apiKey);

//     // Fetch Marq user data and update refresh token if necessary
//     const createusertable = await runServerless({
//       name: 'marqouathhandler',
//       parameters: { userID: userid }
//     });

//     if (createusertable?.response?.body) {
//       const userData = JSON.parse(createusertable.response.body).values || {};
//       const currentRefreshToken = userData.refreshToken;
//       if (currentRefreshToken) {
//         showTemplates(true);
//       }
//     } else {
//       console.error("Failed to create or fetch user table.");
//     }

//      // Fetch Marq user data and update refresh token if necessary
//      const createaccounttable = await runServerless({
//       name: 'dataTableHandler',
//       parameters: { objectType: objectType }
//     });

//     if (createaccounttable?.response?.body) {

//       const accountresponseBody = JSON.parse(createaccounttable.response.body);
//       const accountData = accountresponseBody?.dataRow?.values || {};
        
//       console.log("accountData:", accountData);

//       currentAccountRefreshToken = accountData?.refreshToken || null;
//       console.log("currentAccountRefreshToken:", currentAccountRefreshToken)
//       if (currentAccountRefreshToken) {
//         showTemplates(true);
//         setShowAccountTokenButton(false);
//       } else {
//         setShowAccountTokenButton(true);
//       }

//       setShowTemplates(true);

//     } else {
//       console.error("Failed to create or fetch user table.");
//     }
//     // createOrUpdateDataset(currentAccountRefreshToken)

//   } else if (
//     hasInitialized.current &&
//     fieldsArray.length > 0 &&
//     filtersArray.length > 0 &&
//     Object.keys(crmProperties).length > 0
//   ) {
//     filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
//   }
// };






// const initialize = async () => {
//   if (!hasInitialized.current && objectType) {
//     hasInitialized.current = true;

//     fetchPropertiesAndLoadConfig(objectType);
//     fetchAssociatedProjectsAndDetails(objectType);

//     // Fetch the userid and userEmail from context
//     const userid = context.user.id;
//     const userEmail = context.user.email; // Assuming context provides the user's email here

//     // Fetch the API key and pass the userid and userEmail
//     const apiKey = await setapi(userid, userEmail);
//     setAPIkey(apiKey);

//   } else if (
//     hasInitialized.current &&
//     fieldsArray.length > 0 &&
//     filtersArray.length > 0 &&
//     Object.keys(crmProperties).length > 0
//   ) {
//     filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
//   }
// };

useEffect(() => {
  fetchObjectType();
}, [context.crm.objectTypeId, runServerless]);

useEffect(() => {
  initialize();
}, [
  apiKey,
  accessToken,
  currentRefreshToken,
  context.crm.objectId,
  context.crm.objectTypeId,
  objectType,
  fieldsArray,
  filtersArray,
  crmProperties,
  fulltemplatelist,
  searchTerm
]);







useEffect(() => {
    const handlePropertiesUpdate = (properties) => {
        if (!fieldsArray || fieldsArray.length === 0) {
            console.warn('fieldsArray is empty or undefined:', fieldsArray);
            return;
        }

        const hasRelevantChange = fieldsArray.some(field => properties[field]);

        if (hasRelevantChange) {
            if (context.crm.objectId && context.crm.objectTypeId) {
                fetchPropertiesAndLoadConfig(objectType);

                if (hasInitialized.current && filtersArray.length > 0 && Object.keys(crmProperties).length > 0) {
                    filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
                }
            } 
        } 
    };

    if (fieldsArray && fieldsArray.length > 0) {
        actions.onCrmPropertiesUpdate(fieldsArray, handlePropertiesUpdate);
    } else {
        console.warn('fieldsArray is empty, no properties to watch.');
    }

    return () => {
        actions.onCrmPropertiesUpdate([], null);
    };
}, [context.crm.objectId, context.crm.objectTypeId, objectType, fieldsArray, filtersArray, crmProperties, fulltemplatelist, searchTerm]);


// useEffect(() => {
//   window.updateTokens = (newAccessToken, newRefreshToken) => {
//       setAccessToken(newAccessToken);
//       setRefreshToken(newRefreshToken);
//   };
// }, []);

//   useEffect(() => {
//     const initialize = async () => {
//       if (!hasInitialized.current && objectType) {
//         hasInitialized.current = true;
//         const apiKey = await setapi();  // Wait for setapi() to complete
//         console.log(`This is the API Key: ${apiKey}`);  // Log the API Key
//         fetchPropertiesAndLoadConfig(objectType);
//         fetchAssociatedProjectsAndDetails(objectType);
//       } else if (
//         hasInitialized.current &&
//         fieldsArray.length > 0 &&
//         filtersArray.length > 0 &&
//         Object.keys(crmProperties).length > 0
//       ) {
//         filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
//       }
//     };
  
//     initialize();  // Call the async function
//   }, [
//     context.crm.objectId,
//     context.crm.objectTypeId,
//     objectType,
//     fieldsArray,
//     filtersArray,
//     crmProperties,
//     fulltemplatelist,
//     searchTerm
//   ]);

//   useEffect(() => {
//     const handlePropertiesUpdate = (properties) => {
//         if (!fieldsArray || fieldsArray.length === 0) {
//             console.warn('fieldsArray is empty or undefined:', fieldsArray);
//             return;
//         }

  

//         // Checking for relevant property changes
//         const hasRelevantChange = fieldsArray.some(field => properties[field]);

//         if (hasRelevantChange) {
//             if (context.crm.objectId && context.crm.objectTypeId) {
//                 fetchPropertiesAndLoadConfig(objectType);

//                 if (hasInitialized.current && filtersArray.length > 0 && Object.keys(crmProperties).length > 0) {
//                     filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
//                 }
//             } else {
//             }
//         } else {
//         }
//     };

//     if (fieldsArray && fieldsArray.length > 0) {
//         actions.onCrmPropertiesUpdate(fieldsArray, handlePropertiesUpdate);
//     } else {
//         console.warn('fieldsArray is empty, no properties to watch.');
//     }

//     return () => {
//         actions.onCrmPropertiesUpdate([], null);
//     };
// }, [context.crm.objectId, context.crm.objectTypeId, objectType, fieldsArray, filtersArray, crmProperties, fulltemplatelist, searchTerm]);

{/* <Flex direction="row" align="start" gap="medium">
<Image
  alt="Marq logo"
  src={`https://cdn-cashy-static-assets.marq.com/app/webroot/img/logos/marq/MarqLogo183x50.svg`}
  preventDefault={true}
  width={100}
/>
</Flex> */}

{/* <Flex direction="column" align="start" gap="medium">
<Box flex={1}>
<Image
             alt="Marq logo"
             src={`https://cdn-cashy-static-assets.marq.com/app/webroot/img/logos/marq/MarqLogo183x50.svg`}
             preventDefault={true}
             width={100}
           />
           </Box>
           <Box>

           </Box>
</Flex> */}


const handleConnectToMarq = async (apiKey, userid, userEmail, metadataType) => {
  try {
    const authorizationUrl = getAuthorizationUrl(metadataType, apiKey, userid, userEmail);  // Pass userid and userEmail

    if (!authorizationUrl) {
      throw new Error('Failed to generate authorization URL.');
    }

    return authorizationUrl; // Return the URL to be used in the href
  } catch (error) {
    console.error('Error during authorization process:', error.message);
    // You can handle errors here, but avoid using alert since it's not supported.
  }
};

// const handleGetAccountToken = async (apiKey, userid, userEmail) => {
//   try {
//     // Step 1: Check if the account token exists
//     const response = await runServerless({
//       name: 'dataTableHandler',
//       parameters: {
//         checkExistingToken: true,
//         userid: userid,
//       }
//     });

//     if (response?.response?.body) {
//       const body = JSON.parse(response.response.body);
//       const existingToken = body.refreshToken;

//       if (existingToken) {
//         console.log("Account token already exists:", existingToken);
//         createOrUpdateDataset(existingToken);

//         // Hide the Account Token button once the token is retrieved
//         setShowAccountTokenButton(false); // Hide the button
//         return;
//       }
//     }

//     // Step 3: If no account token exists, initiate the OAuth flow
//     const authorizationUrl = getAuthorizationUrlForData(apiKey, userid, userEmail);
//     // const authorizationCode = await performOAuthFlow(authorizationUrl);

//     if (authorizationUrl) {
//        await handleOAuthCallback(authorizationUrl);

//       // Hide the Account Token button after successful OAuth flow
//       setShowAccountTokenButton(false); // Hide the button
//     }
//   } catch (error) {
//     console.error('Error handling account token click:', error.message);
//   }
// };


//----------------------------------------------------------------------------------------------------------

function getAuthorizationUrl(metadataType, apiKey, userid, userEmail) {
  try {
    const clientId = 'ewn_nCMA1Hr6I0mNLtu4irzVzt29cWn4eqHL2ZnN';
    const clientSecret = 'LPzHZo2GTtzWYPGL-lu_GxpxGCL_7RDDumN0rAmM_WxiFEhFglAE8MM0EnoDHKXJbJ0k1abBdfOqdZjyhx-Q';
    const redirectUri = 'https://info.marq.com/crm-oauth-hubspot';

    const encodedRedirectUri = encodeURIComponent(redirectUri);

    // Create the state map that includes the API key, userId, email, and other details
    const stateMap = {
      apiKey: apiKey,
      metadataType: metadataType,
      clientId: clientId,
      clientSecret: clientSecret,
      redirectUri: encodedRedirectUri,
      userid: userid,       // Include the userId here
      email: userEmail      // Include the userEmail here
    };

    const stateJson = JSON.stringify(stateMap);
    const stateParam = btoa(stateJson); // Encode the state parameter

    let scopes;
    let authorizationUrl;
    let authorizationURLBase;

    // Determine the correct scopes and URL based on the metadata type
    if (metadataType.toLowerCase() === 'data') {
      scopes = 'data-service.admin project.content offline_access';
      authorizationURLBase = 'https://marq.com/oauth2/authorizeAccount';
    } else {
      scopes = 'project.templates project.content offline_access';
      authorizationURLBase = 'https://marq.com/oauth2/authorize';
    }

    const encodedScopes = encodeURIComponent(scopes);

    // Construct the authorization URL
    authorizationUrl = `${authorizationURLBase}`
                     + `?response_type=code`
                     + `&client_id=${clientId}`
                     + `&client_secret=${clientSecret}`
                     + `&scope=${encodedScopes}`
                     + `&redirect_uri=${encodedRedirectUri}`
                     + `&state=${stateParam}`;

    return authorizationUrl;

  } catch (error) {
    console.error('Error generating authorization URL:', error.message);
    return null;
  }
}

//----------------------------------------------------------------------------------------------------------


// function getAuthorizationUrlForData(apiKey, userid, userEmail) {
//   try {
//     const clientId = 'wfcWQOnE4lEpKqjjML2IEHsxUqClm6JCij6QEXGa';
//     const clientSecret = 'YiO9bZG7k1SY-TImMZQUsEmR8mISUdww2a1nBuAIWDC3PQIOgQ9Q44xM16x2tGd_cAQGtrtGx4e7sKJ0NFVX';
//     const redirectUri = 'https://info.marq.com/crm-oauth-hubspot'; // Update as necessary

//     const encodedRedirectUri = encodeURIComponent(redirectUri);

//     // Create the state map that includes the API key, userId, and email
//     const stateMap = {
//       apiKey: apiKey,
//       metadataType: 'data',  // Set metadata type to 'data'
//       clientId: clientId,
//       clientSecret: clientSecret,
//       redirectUri: encodedRedirectUri,
//       userid: userid,       // Include the userId
//       email: userEmail      // Include the userEmail
//     };

//     const stateJson = JSON.stringify(stateMap);
//     const stateParam = btoa(stateJson); // Encode the state parameter

//     // Define the required scopes for "data" metadata type
//     const scopes = 'project.templates project.content data-service.admin offline_access';
//     const encodedScopes = encodeURIComponent(scopes);

//     // Construct the authorization URL for data
//     const authorizationUrl = `https://marq.com/oauth2/authorizeAccount`
//                            + `?response_type=code`
//                            + `&client_id=${clientId}`
//                            + `&client_secret=${clientSecret}`
//                            + `&scope=${encodedScopes}`
//                            + `&redirect_uri=${encodedRedirectUri}`
//                            + `&state=${stateParam}`;

//     return authorizationUrl;

//   } catch (error) {
//     console.error('Error generating authorization URL:', error.message);
//     return null;
//   }
// }

// const handleOAuthCallback = async (code) => {
//   try {
//     // Step 1: Exchange the authorization code for a token
//     const tokenResponse = await runServerless({
//       name: 'exchangeAuthCodeForToken', // DO WE NEED TO CREATE ANOTHER SCRIPT FOR SENDING THE DATA TO UPDATE-DATASET API LIKE THE REDIRECT URI IN THIS FUNCTION??
//       parameters: { code }
//     });

//     // Step 2: Parse the token response to get the refresh token
//     if (tokenResponse?.response?.body) {
//       const body = JSON.parse(tokenResponse.response.body);
//       const refreshToken = body.refresh_token;

//       if (refreshToken) {
//         console.log("Received refresh token:", refreshToken);
        
//         // Step 3: Save the refresh token to the database
//         await saveTokenToTable(refreshToken);

//         // Step 4: Create or update the dataset
//         const datasetResponse = await createOrUpdateDataset(refreshToken, marquserid, dataSetId); // Added marquserid and dataSetId as parameters

//         if (datasetResponse) {
//           const { collectionId, dataSourceId } = datasetResponse; // Get collectionId, dataSourceId from response

//           if (collectionId && dataSourceId) {
//             // Step 5: Call updateDataset to send the data to the dataset
//             const clientid = 'wfcWQOnE4lEpKqjjML2IEHsxUqClm6JCij6QEXGa';
//             const clientsecret = 'YiO9bZG7k1SY-TImMZQUsEmR8mISUdww2a1nBuAIWDC3PQIOgQ9Q44xM16x2tGd_cAQGtrtGx4e7sKJ0NFVX';

//             await runServerless({
//               name: 'updateDataset',
//               parameters: {
//                 refresh_token: refreshToken,
//                 clientid: clientid,
//                 clientsecret: clientsecret,
//                 collectionId: collectionId,
//                 dataSourceId: dataSourceId,
//                 userData: { /* user-specific data */ },   // Provide user-specific data here
//                 customFields: { /* any custom fields to send */ }
//               }
//             });

//             console.log("Data sent successfully to the dataset.");
//           } else {
//             console.error("Missing collectionId or dataSourceId from dataset creation response.");
//           }
//         } else {
//           console.error("Failed to create or update dataset.");
//         }
//       }
//     } else {
//       console.error("Failed to exchange code for token.");
//     }
//   } catch (error) {
//     console.error('Error handling OAuth callback:', error.message);
//   }
// };




// // Chat says to do this but IDK if it will work
// const performOAuthFlow = async (authorizationUrl) => {
//   return new Promise((resolve, reject) => {
//     const authWindow = window.open(authorizationUrl, 'OAuthWindow', 'width=500,height=600');

//     const checkOAuthWindow = setInterval(() => {
//       if (authWindow.closed) {
//         clearInterval(checkOAuthWindow);
//         // Here you would retrieve the authorization code from the window once it’s closed
//         // This is where you capture the code from the popup URL or session storage
//         const code = sessionStorage.getItem('oauth_code');  // Just an example of where to store the code
//         if (code) {
//           resolve(code);
//         } else {
//           reject('Authorization code not found');
//         }
//       }
//     }, 1000);  // Check every second if the window has closed
//   });
// };



async function saveTokenToTable(refreshToken) {
  try {
    const response = await runServerless({
      name: 'dataTableHandler',  // The serverless function that handles the HubDB logic
      parameters: {
        action: 'saveToken',
        refreshToken: refreshToken
      }
    });

    if (response?.response?.statusCode === 200) {
      console.log("Refresh token saved successfully.");
    } else {
      console.error("Failed to save refresh token.");
    }
  } catch (error) {
    console.error('Error saving refresh token:', error.message);
  }
}

const createOrUpdateDataset = async (refreshToken) => {
  try {
    const schema = [
      { name: "Id", fieldType: "STRING", isPrimary: true, order: 1 },
      // Add additional fields as required
    ];

    const marqAccountId = "163559625"; 
    const clientid = 'wfcWQOnE4lEpKqjjML2IEHsxUqClm6JCij6QEXGa';
    const clientsecret = 'YiO9bZG7k1SY-TImMZQUsEmR8mISUdww2a1nBuAIWDC3PQIOgQ9Q44xM16x2tGd_cAQGtrtGx4e7sKJ0NFVX';

    // Define the object types to loop through
    const objectTypes = ['contact', 'company', 'deal', 'ticket', 'data', 'marq_account', 'mat', 'projects', 'lucidpress_subscription', 'feature_request', 'events'];

    // Initialize the refresh token with the passed one
    let currentRefreshToken = refreshToken;

    // Log the starting process
    console.log("Starting createOrUpdateDataset with initialRefreshToken:", currentRefreshToken);

    for (const objectType of objectTypes) {
      console.log(`Processing object type: ${objectType}`);

      try {
        // Log parameters being sent to the serverless function
        console.log(`Sending createDataset request for ${objectType} with parameters:`, {
          refresh_token: currentRefreshToken,             
          clientid: clientid,                      
          clientsecret: clientsecret,              
          marqAccountId: marqAccountId,   
          objectType: objectType,
          schema: schema.map(item => ({
            ...item,
            fieldType: item.fieldType.toString()
          }))
        });

        // Call the createDataset serverless function
        const createDatasetResponse = await runServerless({
          name: 'createDataset',
          parameters: {
            refresh_token: currentRefreshToken,             
            clientid: clientid,                      
            clientsecret: clientsecret,              
            marqAccountId: marqAccountId,   
            objectType: objectType,         
            schema: schema.map(item => ({
              ...item,
              fieldType: item.fieldType.toString() // Ensure fieldType is a string
            })),
          }
        });

        // Check and log the createDataset response
        console.log(`Received createDataset response for ${objectType}:`, createDatasetResponse);

        if (createDatasetResponse?.response?.statusCode === 200) {
          console.log(`Dataset created successfully for ${objectType}`);

          const datasetResult = JSON.parse(createDatasetResponse.response.body);
          const new_refresh_token = datasetResult.new_refresh_token;
          const datasetid = datasetResult.dataSourceId;   
          const collectionid = datasetResult.collectionId;

          console.log(`New values for ${objectType}:`, { new_refresh_token, datasetid, collectionid });

          // Update currentRefreshToken for the next objectType
          currentRefreshToken = new_refresh_token || currentRefreshToken; // Update if new_refresh_token is present

          // Log the updated refresh token
          console.log(`Updated refresh token for next request: ${currentRefreshToken}`);

          // Call the updateDataset function to update the dataset
          console.log(`Sending updateDataset request for ${objectType} with parameters:`, {
            accountId: marqAccountId,
            objectType: objectType,
            refreshToken: currentRefreshToken,   // Use the updated refresh token
            datasetid: datasetid,
            collectionid: collectionid
          });

          const updateDatasetResponse = await runServerless({
            name: 'updateDataset',
            parameters: {
              accountId: marqAccountId,             
              objectType: objectType,               
              refreshToken: currentRefreshToken,   
              datasetid: datasetid,                
              collectionid: collectionid           
            }
          });

          // Check and log the updateDataset response
          console.log(`Received updateDataset response for ${objectType}:`, updateDatasetResponse);

          if (updateDatasetResponse?.response?.statusCode === 200) {
            console.log(`Data sent successfully to the dataset for ${objectType}`);
          } else {
            console.error(`Failed to send data to the dataset for ${objectType}:`, updateDatasetResponse?.response?.body);
          }
        } else {
          console.error(`Failed to create or update dataset for ${objectType}:`, createDatasetResponse?.response?.body);
          console.log({refresh_token: currentRefreshToken,             
            clientid: clientid,                      
            clientsecret: clientsecret,              
            marqAccountId: marqAccountId,   
            objectType: objectType})
        }
      } catch (apiError) {
        console.error(`Error processing object type: ${objectType}`, apiError);
      }
    }
  } catch (error) {
    console.error('Error in createOrUpdateDataset:', error.message);
  }
};







// ORIGINAL createOrUpdateDataset FUNCTION
// const createOrUpdateDataset = async (refreshToken, objectType) => {
//   try {
//     // Define the schema for the dataset
//     const schema = [
//       { name: "Id", fieldType: "STRING", isPrimary: true , order: 1 },
//       // Add additional fields as required, ensuring fieldType is a string
//     ];

//     const marqAccountId = "163559625"; 
//     const clientid = 'wfcWQOnE4lEpKqjjML2IEHsxUqClm6JCij6QEXGa';
//     const clientsecret = 'YiO9bZG7k1SY-TImMZQUsEmR8mISUdww2a1nBuAIWDC3PQIOgQ9Q44xM16x2tGd_cAQGtrtGx4e7sKJ0NFVX';

//     console.log("marqAccountId:", marqAccountId, "clientid:", clientid, "refreshToken:", refreshToken);

//     console.log("Payload sent to create-dataset:", {
//       refresh_token: refreshToken,
//       clientid: clientid,
//       clientsecret: clientsecret,
//       marqAccountId: marqAccountId,
//       objectType: objectType,  // Pass the objectType
//       properties: { },  // Print properties to ensure correctness
//       schema: schema
//     });

//     // Step 1: Call the createDataset serverless function to create or update the dataset
//     let createDatasetResponse;
//     try {
//       createDatasetResponse = await runServerless({
//         name: 'createDataset',
//         parameters: {
//           refresh_token: refreshToken,             
//           clientid: clientid,                      
//           clientsecret: clientsecret,              
//           marqAccountId: marqAccountId,   
//           objectType: objectType,  // Pass the objectType         
//           schema: schema.map(item => ({
//             ...item,
//             fieldType: item.fieldType.toString() // Ensure fieldType is a string
//           })),
//           ...(Object.keys(crmProperties).length > 0 ? { crmProperties } : {}),
//         }
//       });
//     } catch (apiError) {
//       console.error("Error during the API call to createDataset:", apiError);
//       throw new Error("API call to createDataset failed");
//     }

//     // Step 2: Validate the response and extract necessary data
//     if (createDatasetResponse?.response?.statusCode === 200) {
//       console.log("Dataset created and updated successfully.");

//       // Ensure that the response has the required fields
//       const responseBody = createDatasetResponse.response.body;
//       if (!responseBody) {
//         console.error("Invalid response body from createDataset");
//         return;
//       }

//       // Parse the response body
//       const datasetResult = JSON.parse(responseBody);
//       const new_refresh_token = datasetResult.new_refresh_token;
//       const datasetid = datasetResult.dataSourceId;   // Correct spelling: datasetid
//       const collectionid = datasetResult.collectionId; // Correct spelling: collectionid

//       console.log("New values:", { new_refresh_token, datasetid, collectionid });

//       // Step 3: Call the updateDataset function to update the dataset with marqAccountId
//       let updateDatasetResponse;
//       try {
//         updateDatasetResponse = await runServerless({
//           name: 'updateDataset',
//           parameters: {
//             accountId: marqAccountId,             // Pass the marqAccountId as accountId
//             refreshToken: new_refresh_token,      // Pass the new refresh token
//             datasetid: datasetid,                // Pass the datasetid from the create-dataset response
//             collectionid: collectionid           // Pass the collectionid from the create-dataset response
//           }
//         });
//       } catch (updateError) {
//         console.error("Error during the API call to updateDataset:", updateError);
//         throw new Error("API call to updateDataset failed");
//       }

//       // Step 4: Check the response from the updateDataset function
//       if (updateDatasetResponse?.response?.statusCode === 200) {
//         console.log("Data sent successfully to the dataset.");
//       } else {
//         console.error("Failed to send data to the dataset:", updateDatasetResponse?.response?.body);
//       }

//     } else {
//       console.error("Failed to create or update dataset:", createDatasetResponse?.response?.body);
//     }
//   } catch (error) {
//     console.error('Error creating or updating dataset:', error.message);
//   }
// };






//===================================================================================================
//===================================================================================================

if (iframeLoading || isLoading) {
  return (
    <Flex direction="column" gap="medium" align="center">
      <LoadingSpinner label="Loading projects..." layout="centered" />
    </Flex>
  );
} 

// if (!isLoading && !templateLink) {
//   return (
//     <EmptyState title="Failed to load templates" layout="vertical">
//       <Text>We couldn't load the templates. Please try reloading.</Text>
//       <Button variant="primary" onClick={fetchPropertiesAndLoadConfig}>
//         Reload Templates
//       </Button>
//     </EmptyState>
//   );
// }



if (showTemplates) {

return (
  <>
    {/* Account Token Button */}
    {showAccountTokenButton && (
        <Button
          href={accountoauthUrl}
          variant="primary"
          size="small"
          type="button"
          onClick={startPollingForAccountRefreshToken} 
        >
          Account Token
        </Button>
      )}


    

    <Form>
      <Flex direction="row" justify="center" gap="small">
        <Box flex={1}>
          <Input
            type="text"
            placeholder="⌕ Search all templates"
            value={searchTerm}
            onInput={handleSearch}
            style={{ width: '100%' }}
          />
        </Box>
      </Flex>

      <Divider />

      <Flex direction="column" align="start" gap="small">
        <Box />
        <Box>
          <Text format={{ fontWeight: 'bold' }}>{title}</Text>
        </Box>
      </Flex>
    </Form>

    <Table
      paginated
      page={currentPage}
      pageCount={totalPages}
      maxVisiblePageButtons={5}
      showButtonLabels
      showFirstLastButtons={false}
      onPageChange={handlePageChange}
    >
      <TableBody>
        {paginatedTemplates.map((template, index) => {
          const matchingProject = projects.find(
            project => project.originaltemplateid === template.id
          );

          return matchingProject ? (
            <TableRow key={matchingProject.objectId || index}>
              <TableCell>
                <Image
                  alt="File Preview"
                  src={`https://app.marq.com/documents/thumb/${matchingProject.projectid}/0/2048/NULL/400`}
                  onClick={() => editClick(matchingProject.projectid, matchingProject.fileid, matchingProject.encodedoptions)}
                  preventDefault
                  width={100}
                />
              </TableCell>
              <TableCell>
                <Link
                  href="#"
                  onClick={() => editClick(matchingProject.projectid, matchingProject.fileid, matchingProject.encodedoptions)}
                  preventDefault
                  variant="primary"
                >
                  {matchingProject.name}
                </Link>
              </TableCell>
              <TableCell>{formatDate(matchingProject.hs_lastmodifieddate)}</TableCell>
              <TableCell>
                <ButtonRow disableDropdown={false}>
                  <Button onClick={() => editClick(matchingProject.projectid, matchingProject.fileid, matchingProject.encodedoptions)}>
                    Open
                  </Button>
                  <CrmActionButton actionType="EXTERNAL_URL" actionContext={{ href: matchingProject.fileurl }} variant="secondary">
                    Copy Published URL
                  </CrmActionButton>
                  <CrmActionButton
                    actionType="SEND_EMAIL"
                    actionContext={{
                      objectTypeId: context.crm.objectTypeId,
                      objectId: context.crm.objectId,
                    }}
                    variant="secondary"
                  >
                    Send email
                  </CrmActionButton>
                  <Button variant="destructive" onClick={() => deleteRecord(matchingProject.objectId, 'projects')}>
                    Delete
                  </Button>
                </ButtonRow>
              </TableCell>
            </TableRow>
          ) : (
            <TableRow key={template.id || index} onClick={() => setSelectedRow(selectedRow === index ? null : index)}>
              <TableCell>
                <Image
                  alt="Template Preview"
                  src={`https://app.marq.com/documents/thumb/${template.id}/0/2048/NULL/400`}
                  onClick={() => handleClick(template)}
                  preventDefault
                  width={100}
                />
              </TableCell>
              <TableCell>
                <Link
                  href="#"
                  onClick={() => handleClick(template)}
                  preventDefault
                  variant="primary"
                >
                  {template.title}
                </Link>
              </TableCell>
              <TableCell />
              <TableCell>
                <Button onClick={() => handleClick(template)}>Create with Marq</Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </>
);

} else {
  return (
    <Button
      // href={authurl}
      href={authurl}
      variant="primary"
      size="med"
      type="button"
      onClick={startPollingForRefreshToken}
    >
      Connect to Marq
    </Button>
  );
}
}

export default Extension;